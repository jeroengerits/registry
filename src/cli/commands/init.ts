import type { CommandResult } from '../../types.js';
import { readRootVersion, readState, writeState } from '../../state.js';
import { colors, frame, outcome, withSpinner } from '../ui.js';

/** Initializes an empty project-local UI Registry state file. */
export async function initProject(cwd: string, json = false): Promise<CommandResult> {
  if (await readState(cwd)) {
    if (json) return { output: `${JSON.stringify({ initialized: false, alreadyInitialized: true, file: 'ui.json' })}\n`, exitCode: 0 };
    return { output: frame('init', `${outcome('UI Registry is already initialized.', 'warning')}\n\nConfiguration  ${colors.info('ui.json')}`, 'Next: ui component list'), exitCode: 0 };
  }
  const version = await readRootVersion(cwd);
  await withSpinner('Initializing UI project...', () => writeState(cwd, { ...(version ? { version } : {}), components: {} }), () => 'Project initialized', !json);
  if (json) return { output: `${JSON.stringify({ initialized: true, file: 'ui.json', ...(version ? { version } : {}) })}\n`, exitCode: 0 };
  return { output: frame('init', `${outcome('Project ready.')}\n\nCreated  ${colors.info('ui.json')}${version ? `\nVersion  ${colors.muted(version)}` : ''}\n\nAdd your first component:\n  ${colors.info('ui component add owner/repository')}`), exitCode: 0 };
}
