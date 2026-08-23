import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CommandResult, UiState } from '../../../types.js';
import { readState, writeState } from '../../../state.js';
import { copySafeFile, projectFileExists, removeSafeFile, safeFilePath } from '../../../filesystem.js';
import { safeJoin } from '../../../paths.js';
import { errorResult } from '../shared.js';
import { frame, outcome, withSpinner } from '../../ui.js';
import { present } from '../../presentation.js';

const ROLLBACK_DIRECTORY = '.ui-rollback';
const ROLLBACK_STATE = 'state.json';

/** Reports whether the one-step rollback point is available. */
export async function rollbackStatus(cwd: string, json = false): Promise<CommandResult> {
  try {
    const state = JSON.parse(await readFile(path.join(cwd, ROLLBACK_DIRECTORY, ROLLBACK_STATE), 'utf8')) as UiState;
    const components = Object.keys(state.components).sort();
    return present(json, { available: true, components }, json ? '' : `undo available\ncomponents: ${components.join(', ') || 'none'}\n`);
  } catch {
    return present(json, { available: false, components: [] }, 'no undo available\n');
  }
}

/** Stores the pre-update state and tracked files as a one-step rollback point. */
export async function saveRollback(cwd: string, state: UiState): Promise<void> {
  const directory = path.join(cwd, ROLLBACK_DIRECTORY);
  await rm(directory, { recursive: true, force: true });
  await mkdir(path.join(directory, 'files'), { recursive: true });
  await writeFile(path.join(directory, ROLLBACK_STATE), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  for (const component of Object.values(state.components)) {
    for (const file of component.files ?? []) {
      if (!await projectFileExists(cwd, file.path, 'rollback source')) continue;
      await copySafeFile(await safeFilePath(cwd, file.path, 'rollback source'), safeJoin(directory, `files/${file.path}`, 'rollback target'), 'rollback file');
    }
  }
}

/** Restores the last component update and removes the consumed rollback point. */
export async function revertComponent(cwd: string, json = false): Promise<CommandResult> {
  const directory = path.join(cwd, ROLLBACK_DIRECTORY);
  let previous: UiState;
  try {
    previous = JSON.parse(await readFile(path.join(directory, ROLLBACK_STATE), 'utf8')) as UiState;
  } catch {
    return errorResult('No component update is available to revert.', json);
  }
  const current = await readState(cwd);
  if (!current) return errorResult('The project is not initialized.', json);
  await withSpinner('Reverting the last component update...', async () => {
    for (const component of Object.values(current.components)) {
      for (const file of component.files ?? []) await removeSafeFile(cwd, file.path, 'component file');
    }
    for (const component of Object.values(previous.components)) {
      for (const file of component.files ?? []) {
        const backup = safeJoin(directory, `files/${file.path}`, 'rollback source');
        await copySafeFile(backup, safeJoin(cwd, file.path, 'component file'), 'restored file');
      }
    }
    await writeState(cwd, previous);
    await rm(directory, { recursive: true, force: true });
  }, () => 'Component update reverted');
  return present(json, { reverted: true }, frame('component revert', outcome('The last component update was reverted.'), 'Next: ui component list'));
}
