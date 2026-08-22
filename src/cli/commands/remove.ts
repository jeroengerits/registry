import { unlink } from 'node:fs/promises';
import type { CommandResult } from '../../types.js';
import { readState, writeState } from '../../state.js';
import { safeJoin } from '../../paths.js';
import { errorResult } from './shared.js';
import { chooseComponent, confirmAction, frame, interactive, outcome, withSpinner } from '../ui.js';

export async function removeComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  const state = await readState(cwd);
  if (!name && interactive() && state && Object.keys(state.components).length) name = await chooseComponent(Object.keys(state.components).sort(), 'Select a component to remove');
  if (!name) return errorResult('Usage: ui component remove <name> [--json]');
  const component = state?.components[name];
  if (!state || !component) return errorResult(`Component "${name}" is not installed.`);
  if (interactive() && !(await confirmAction(`Remove ${name} and its ${component.files?.length ?? 0} tracked file(s)?`))) return errorResult('Operation cancelled.');

  const files = new Set([component.path, ...(component.files ?? []).map((file) => file.path)].filter(Boolean));
  await withSpinner(`Removing ${name}...`, async () => {
    for (const file of files) await unlink(safeJoin(cwd, file, 'component file')).catch((error: unknown) => {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    });
    delete state.components[name];
    await writeState(cwd, state);
  }, () => `Removed ${name}`, !json);
  return { output: json ? `${JSON.stringify({ name })}\n` : frame(`component remove  ·  ${name}`, outcome(`Removed component "${name}".`), 'Next: ui component list'), exitCode: 0 };
}
