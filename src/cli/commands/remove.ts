import { unlink } from 'node:fs/promises';
import type { CommandResult } from '../../types.js';
import { readState, writeState } from '../../state.js';
import { safeJoin } from '../../paths.js';
import { errorResult } from './shared.js';
import { withSpinner } from '../ui.js';
import { colors } from '../ui.js';

export async function removeComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  if (!name) return errorResult('Usage: ui component remove <name> [--json]');
  const state = await readState(cwd);
  const component = state?.components[name];
  if (!state || !component) return errorResult(`Component "${name}" is not installed.`);

  const files = new Set([component.path, ...(component.files ?? []).map((file) => file.path)].filter(Boolean));
  await withSpinner(`Removing ${name}...`, async () => {
    for (const file of files) await unlink(safeJoin(cwd, file, 'component file')).catch((error: unknown) => {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    });
    delete state.components[name];
    await writeState(cwd, state);
  }, () => `Removed ${name}`, !json);
  return { output: json ? `${JSON.stringify({ name })}\n` : `${colors.success(`Removed component "${name}".`)}\n`, exitCode: 0 };
}
