import { unlink } from 'node:fs/promises';
import type { CommandResult } from '../../../types.js';
import { readState, writeState } from '../../../state.js';
import { safeJoin } from '../../../paths.js';
import { errorResult } from '../shared.js';
import { chooseComponent, confirmAction, frame, interactive, outcome, withSpinner } from '../../ui.js';

/** Removes a component's tracked files and persisted state. */
export async function removeComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  // Read state before resolving an optional interactive selection.
  const state = await readState(cwd);
  // Let interactive users choose a component without weakening script usage.
  if (!name && interactive() && state && Object.keys(state.components).length) name = await chooseComponent(Object.keys(state.components).sort(), 'Select a component to remove');
  // Require a name when no picker can be shown.
  if (!name) return errorResult('Usage: ui component remove <name> [--json]');
  // Resolve the record that owns the files about to be removed.
  const component = state?.components[name];
  // Refuse to mutate state when the component is absent.
  if (!state || !component) return errorResult(`Component "${name}" is not installed.`);
  // Confirm destructive work only in interactive terminals.
  if (interactive() && !(await confirmAction(`Remove ${name} and its ${component.files?.length ?? 0} tracked file(s)?`))) return errorResult('Operation cancelled.');

  // Combine the primary path and tracked files without duplicate deletions.
  const files = new Set([component.path, ...(component.files ?? []).map((file) => file.path)].filter(Boolean));
  // Remove files and state together under the shared spinner.
  await withSpinner(`Removing ${name}...`, async () => {
    // Missing files are already removed and do not block state cleanup.
    for (const file of files) await unlink(safeJoin(cwd, file, 'component file')).catch((error: unknown) => {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    });
    // Delete the component record only after file deletion succeeds.
    delete state.components[name];
    // Persist the remaining registry state atomically.
    await writeState(cwd, state);
  }, () => `Removed ${name}`, !json);
  // Count the tracked paths for a useful human-readable result.
  const removedFiles = files.size;
  // Keep JSON minimal while giving human output context and a next step.
  return { output: json ? `${JSON.stringify({ name })}\n` : frame(`component remove  ·  ${name}`, `${name}\n\nFiles removed  ${removedFiles}\n\n${outcome(`Removed component "${name}".`)}`, 'Next: ui component list'), exitCode: 0 };
}
