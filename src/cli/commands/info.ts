import type { CommandResult } from '../../types.js';
import { readState } from '../../state.js';
import { errorResult } from './shared.js';
import { chooseComponent, frame, outcome, status, interactive } from '../ui.js';

export async function infoComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  const state = await readState(cwd);
  if (!name && interactive() && state && Object.keys(state.components).length) name = await chooseComponent(Object.keys(state.components).sort(), 'Select a component to inspect');
  if (!name) return errorResult('Usage: ui component info <name> [--json]');
  const component = state?.components[name];
  if (!component) return errorResult(`Component "${name}" is not installed.`);
  if (json) return { output: `${JSON.stringify({ name, ...component }, null, 2)}\n`, exitCode: 0 };
  const lines = [
    `${name}  ${status(component.enabled)}`,
    '────────────────────────────────────────',
    `Version      ${component.version}`,
    `Location     ${component.path}`,
    `Repository   ${component.repository ?? 'local / unknown'}`,
    `Files        ${component.files?.length ?? 0}`,
    `Dependencies ${component.dependencies?.length ?? 0}`,
    '',
    outcome('Component details loaded.'),
  ];
  return { output: frame(`component info  ·  ${name}`, lines.join('\n'), `Toggle: ui component toggle ${name}`), exitCode: 0 };
}
