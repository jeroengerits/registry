import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import type { CommandResult } from '../../../types.js';
import { readState, writeState } from '../../../state.js';
import { copySafeFile, projectFileExists, removeSafeFile, safeFilePath } from '../../../filesystem.js';
import { safeJoin } from '../../../paths.js';
import { errorResult } from '../shared.js';
import { confirmAction, frame, resultLine, interactive, withSpinner } from '../../ui.js';
import { failure, present } from '../../presentation.js';

/** Removes a component's tracked files and persisted state. */
export async function removeComponent(cwd: string, name?: string, json = false, yes = false, dryRun = false): Promise<CommandResult> {
  // Read state before resolving the requested component.
  const state = await readState(cwd);
  // One-shot commands require the component name explicitly.
  if (!name) return errorResult('Usage: ui remove <name> [--dry-run] [--yes] [--json]', json);
  // Resolve the record that owns the files about to be removed.
  const component = state?.components[name];
  // Refuse to mutate state when the component is absent.
  if (!state || !component) return errorResult(`Component "${name}" is not installed.`, json);
  const files = new Set([component.path, ...(component.files ?? []).map((file) => file.path)].filter(Boolean));
  if (dryRun) {
    const preview = [`would remove ${name}`, ...[...files].map((file) => `  ${file}`)].join('\n');
    return present(json, { name, files: [...files], dryRun: true }, frame('component remove', preview));
  }
  if (!interactive() && !yes) return failure(json, 'Refusing to remove without confirmation. Re-run with --yes.', 'confirmation_required', 2);
  // Confirm destructive work only in interactive terminals.
  if (interactive() && !yes && !(await confirmAction(`Remove ${name} and its ${component.files?.length ?? 0} tracked file(s)?`))) return failure(json, 'Operation cancelled.');

  // Combine the primary path and tracked files without duplicate deletions.
  // Remove files and state together under the shared spinner.
  await withSpinner(`Removing ${name}...`, async () => {
    const backup = await mkdtemp(path.join(cwd, '.ui-remove-'));
    const backedUp: string[] = [];
    try {
      // Capture every existing file before changing either the filesystem or state.
      for (const file of files) {
        if (!await projectFileExists(cwd, file, 'component file')) continue;
        await copySafeFile(await safeFilePath(cwd, file, 'component file'), safeJoin(backup, file, 'component backup'), 'component backup');
        backedUp.push(file);
      }
      for (const file of files) await removeSafeFile(cwd, file, 'component file');
      delete state.components[name];
      await writeState(cwd, state);
    } catch (error) {
      // Restore files and the previous state when removal or persistence fails.
      for (const file of files) await removeSafeFile(cwd, file, 'rollback component file').catch(() => undefined);
      for (const file of backedUp) await copySafeFile(safeJoin(backup, file, 'component backup'), safeJoin(cwd, file, 'rollback target'), 'rollback component file').catch(() => undefined);
      throw error;
    } finally {
      await rm(backup, { recursive: true, force: true });
    }
  }, () => `Removed ${name}`, !json);
  // Count the tracked paths for a useful human-readable result.
  const removedFiles = files.size;
  // Keep JSON minimal while giving human output context and a next step.
  return present(json, { name, files: removedFiles }, resultLine('removed', `${name} (${removedFiles} file${removedFiles === 1 ? '' : 's'})`));
}
