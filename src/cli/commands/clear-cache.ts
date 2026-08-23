import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import type { CommandResult } from '../../types.js';
import { failure, present } from '../presentation.js';
import { confirmAction, interactive } from '../ui.js';

const SOURCE_CACHE = '.ui-sources';

/** Removes persistent project-local remote component checkouts. */
export async function clearCache(cwd: string, json = false, yes = false): Promise<CommandResult> {
  const directory = path.join(cwd, SOURCE_CACHE);
  const entries = await readdir(directory).catch(() => []);
  if (!entries.length) return present(json, { cleared: true, entries: 0 }, 'cache already clear\n');
  if (!interactive() && !yes) return failure(json, 'Refusing to clear cache without confirmation. Re-run with --yes.', 'confirmation_required', 2);
  if (interactive() && !yes && !(await confirmAction(`Clear ${entries.length} cached source(s)?`))) return present(json, { cleared: false, cancelled: true, entries: entries.length }, 'Clear cancelled.\nNo changes were made.\n');
  await rm(directory, { recursive: true, force: true });
  return present(json, { cleared: true, entries: entries.length }, `cleared cache (${entries.length} source${entries.length === 1 ? '' : 's'})\n`);
}
