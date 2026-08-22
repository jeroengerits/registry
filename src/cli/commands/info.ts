import type { CommandResult } from '../../types.js';
import { readState } from '../../state.js';
import { errorResult } from './shared.js';
import { chooseComponent, interactive } from '../ui.js';

export async function infoComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  const state = await readState(cwd);
  if (!name && interactive() && state && Object.keys(state.components).length) name = await chooseComponent(Object.keys(state.components).sort(), 'Select a component to inspect');
  if (!name) return errorResult('Usage: ui component info <name> [--json]');
  const component = state?.components[name];
  if (!component) return errorResult(`Component "${name}" is not installed.`);
  return { output: json ? `${JSON.stringify({ name, ...component }, null, 2)}\n` : `${name}@${component.version}\nPath: ${component.path}\n`, exitCode: 0 };
}
