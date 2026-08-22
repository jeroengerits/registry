import { copyFile, mkdir, mkdtemp, rm, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { CommandResult } from '../types.js';
import { readState, writeState } from '../state.js';
import { safeJoin } from '../paths.js';
import { errorResult, protectedDelete } from './shared.js';

export async function removeComponent(cwd: string, name: string | undefined, overwrite: boolean): Promise<CommandResult> {
  if (!name) return errorResult('Usage: ui remove <name> [--overwrite]');
  const state = await readState(cwd);
  const component = state?.components[name];
  if (!state || !component) return errorResult(`Component "${name}" is not installed.`);
  await protectedDelete(cwd, component, overwrite);
  const backup = await mkdtemp(path.join(cwd, '.ui-remove-backup-'));
  const files = component.files ?? [{ path: component.path, sha256: '' }];
  try {
    for (const file of files) {
      const source = safeJoin(cwd, file.path, 'path');
      try { const saved = safeJoin(backup, file.path, 'backup'); await mkdir(path.dirname(saved), { recursive: true }); await copyFile(source, saved); await unlink(source); } catch { /* missing tracked files are harmless */ }
    }
    delete state.components[name];
    await writeState(cwd, state);
    return { output: `Removed ${name}.\n`, exitCode: 0 };
  } catch (error) {
    for (const file of files) { try { await mkdir(path.dirname(safeJoin(cwd, file.path, 'path')), { recursive: true }); await copyFile(safeJoin(backup, file.path, 'backup'), safeJoin(cwd, file.path, 'path')); } catch { /* no prior file */ } }
    throw error;
  } finally { await rm(backup, { recursive: true, force: true }); }
}
