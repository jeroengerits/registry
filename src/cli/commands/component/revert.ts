import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CommandResult, UiState } from '../../../types.js';
import { readState, validateState, writeState } from '../../../state.js';
import { copySafeFile, projectFileExists, removeSafeFile, safeFilePath } from '../../../filesystem.js';
import { safeJoin } from '../../../paths.js';
import { errorResult } from '../shared.js';
import { resultLine, withSpinner } from '../../ui.js';
import { present } from '../../presentation.js';

const ROLLBACK_DIRECTORY = '.ui-rollback';
const ROLLBACK_STATE = 'state.json';

/** Reports whether the one-step rollback point is available. */
export async function rollbackStatus(cwd: string, json = false): Promise<CommandResult> {
  try {
    const state = validateState(JSON.parse(await readFile(path.join(cwd, ROLLBACK_DIRECTORY, ROLLBACK_STATE), 'utf8')));
    const components = Object.keys(state.components).sort();
    return present(json, { available: true, components }, json ? '' : `undo available\ncomponents: ${components.join(', ') || 'none'}\n`);
  } catch {
    return present(json, { available: false, components: [] }, 'no undo available\n');
  }
}

/** Stores the pre-update state and tracked files as a one-step rollback point. */
export async function saveRollback(cwd: string, state: UiState): Promise<void> {
  const directory = path.join(cwd, ROLLBACK_DIRECTORY);
  const temporary = await mkdtemp(path.join(cwd, `${ROLLBACK_DIRECTORY}.tmp-`));
  await mkdir(path.join(temporary, 'files'), { recursive: true });
  await writeFile(path.join(temporary, ROLLBACK_STATE), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  for (const component of Object.values(state.components)) {
    for (const file of component.files ?? []) {
      if (!await projectFileExists(cwd, file.path, 'rollback source')) continue;
      await copySafeFile(await safeFilePath(cwd, file.path, 'rollback source'), safeJoin(temporary, `files/${file.path}`, 'rollback target'), 'rollback file');
    }
  }
  const backup = path.join(cwd, `${ROLLBACK_DIRECTORY}.previous-${process.pid}`);
  try {
    await rm(backup, { recursive: true, force: true });
    try { await rename(directory, backup); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    await rename(temporary, directory);
    await rm(backup, { recursive: true, force: true });
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    try { await rename(backup, directory); } catch { /* Preserve the original failure. */ }
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

/** Restores the last component update and removes the consumed rollback point. */
export async function revertComponent(cwd: string, json = false): Promise<CommandResult> {
  const directory = path.join(cwd, ROLLBACK_DIRECTORY);
  let previous: UiState;
  try {
    previous = validateState(JSON.parse(await readFile(path.join(directory, ROLLBACK_STATE), 'utf8')));
  } catch {
    return errorResult('No component update is available to revert.', json);
  }
  const current = await readState(cwd);
  if (!current) return errorResult('The project is not initialized.', json);
  await withSpinner('Reverting the last component update...', async () => {
    const stage = await mkdtemp(path.join(cwd, '.ui-revert-'));
    const currentFiles = [...new Set(Object.values(current.components).flatMap((component) => (component.files ?? []).map((file) => file.path)))];
    const previousFiles = [...new Set(Object.values(previous.components).flatMap((component) => (component.files ?? []).map((file) => file.path)))];
    const backedUp: string[] = [];
    try {
      for (const file of currentFiles) {
        if (!await projectFileExists(cwd, file, 'component file')) continue;
        await copySafeFile(await safeFilePath(cwd, file, 'component file'), safeJoin(stage, `current/${file}`, 'current backup'), 'current backup');
        backedUp.push(file);
      }
      // Validate every rollback source before removing current project files.
      for (const file of previousFiles) await safeFilePath(directory, `files/${file}`, 'rollback source');
      for (const file of currentFiles) await removeSafeFile(cwd, file, 'component file');
      for (const file of previousFiles) await copySafeFile(safeJoin(directory, `files/${file}`, 'rollback source'), safeJoin(cwd, file, 'component file'), 'restored file');
      await writeState(cwd, previous);
      await rm(directory, { recursive: true, force: true });
    } catch (error) {
      // Rebuild the previous project contents and metadata if any mutation fails.
      for (const file of previousFiles) await removeSafeFile(cwd, file, 'rollback cleanup').catch(() => undefined);
      for (const file of backedUp) await copySafeFile(safeJoin(stage, `current/${file}`, 'current backup'), safeJoin(cwd, file, 'rollback target'), 'restored current file').catch(() => undefined);
      await writeState(cwd, current).catch(() => undefined);
      throw error;
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
  }, () => 'Component update reverted');
  return present(json, { reverted: true }, resultLine('reverted', 'last update'));
}
