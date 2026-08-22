import type { CommandResult, ComponentState, UiState } from '../types.js';
import { readState } from '../state.js';
import { parseGitReference, type GitReference } from '../git.js';
import { applyPlans, aggregateDependencies, errorResult, planFiles, protectedDelete, resolveReferences } from './shared.js';

export async function updateComponent(cwd: string, reference: string | undefined, overwrite: boolean): Promise<CommandResult> {
  const state = await readState(cwd);
  if (!state) return errorResult('No installed components.');
  const names = reference ? [reference] : Object.keys(state.components).sort();
  if (!names.length) return errorResult('No installed components.');
  const refs: GitReference[] = [];
  for (const name of names) { const old = state.components[name]; if (!old?.repository) return errorResult(`Component "${name}" has no repository in ui.json.`); refs.push(parseGitReference(old.repository)); }
  if (reference && !state.components[reference]) refs.splice(0, refs.length, parseGitReference(reference));
  const resolved = await resolveReferences(refs);
  try {
    const replacing = new Map<string, ComponentState>();
    for (const item of resolved) { const old = state.components[item.manifest.name]; if (old) { await protectedDelete(cwd, old, overwrite); replacing.set(item.manifest.name, old); } }
    const plans = await planFiles(cwd, resolved, replacing);
    const next: UiState = { ...state, components: { ...state.components } };
    for (const item of resolved) next.components[item.manifest.name] = { repository: item.reference.repository, version: item.version, path: item.manifest.files[0]?.target ?? '', files: item.manifest.files.map((file) => ({ path: file.target, sha256: '' })), dependencies: item.manifest.components };
    await applyPlans(cwd, next, plans, replacing, aggregateDependencies(resolved), overwrite);
    return { output: `${resolved.map((item) => `Updated ${item.manifest.name}@${item.version}`).join('\n')}\n`, exitCode: 0 };
  } finally { await Promise.all(resolved.map((item) => item.cleanup())); }
}
