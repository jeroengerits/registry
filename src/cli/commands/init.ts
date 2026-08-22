import type { CommandResult } from '../../types.js';
import { initializeState, readRootVersion, readState } from '../../state.js';
import { colors, frame, outcome, withSpinner } from '../ui.js';
import { present } from '../presentation.js';

/** Initializes an empty project-local UI Registry state file. */
export async function initProject(cwd: string, json = false): Promise<CommandResult> {
  if (await readState(cwd)) {
    if (json) return present(true, { initialized: false, alreadyInitialized: true, file: 'ui.json' }, '');
    return { output: frame('init', `${outcome('UI Registry is already initialized.', 'warning')}\n\nConfiguration  ${colors.info('ui.json')}`, 'Next: ui component list'), exitCode: 0 };
  }
  const version = await readRootVersion(cwd);
  const initialized = await withSpinner('Initializing UI project...', () => initializeState(cwd, { ...(version ? { version } : {}), components: {} }), (created) => created ? 'Project initialized' : 'UI project already initialized', !json);
  if (!initialized) {
    if (json) return present(true, { initialized: false, alreadyInitialized: true, file: 'ui.json' }, '');
    return { output: frame('init', `${outcome('UI Registry is already initialized.', 'warning')}\n\nConfiguration  ${colors.info('ui.json')}`, 'Next: ui component list'), exitCode: 0 };
  }
  if (json) return present(true, { initialized: true, file: 'ui.json', ...(version ? { version } : {}) }, '');
  return { output: frame('init', `${outcome('Project ready.')}\n\nCreated  ${colors.info('ui.json')}${version ? `\nVersion  ${colors.muted(version)}` : ''}\n\nAdd your first component:\n  ${colors.info('ui component add owner/repository')}`), exitCode: 0 };
}
