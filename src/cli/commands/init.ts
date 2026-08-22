import type { CommandResult } from '../../types.js';
import { readRootVersion, readState, writeState } from '../../state.js';
import { errorResult } from './shared.js';
import { colors, frame, outcome, withSpinner } from '../ui.js';

/** Initializes an empty project-local UI Registry state file. */
export async function initProject(cwd: string, json = false): Promise<CommandResult> {
  if (await readState(cwd)) return errorResult('This project is already initialized. ui.json already exists.');
  const version = await readRootVersion(cwd);
  await withSpinner('Initializing UI project...', () => writeState(cwd, { ...(version ? { version } : {}), components: {} }), () => 'Project initialized', !json);
  if (json) return { output: `${JSON.stringify({ initialized: true, file: 'ui.json', ...(version ? { version } : {}) })}\n`, exitCode: 0 };
  return { output: frame('init', `${outcome('UI project initialized.')}\n\nState file  ${colors.info('ui.json')}${version ? `\nVersion     ${colors.muted(version)}` : ''}`, 'Next: ui components'), exitCode: 0 };
}
