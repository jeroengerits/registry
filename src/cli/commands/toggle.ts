import type { CommandResult } from '../../types.js';
import { readState, writeState } from '../../state.js';
import { chooseComponent, frame, interactive, outcome, status } from '../ui.js';
import { errorResult } from './shared.js';

export async function toggleComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  const state = await readState(cwd);
  if (!name && interactive() && state && Object.keys(state.components).length) name = await chooseComponent(Object.keys(state.components).sort(), 'Select a component to toggle');
  if (!name) return errorResult('Usage: ui component toggle <name> [--json]');
  const component = state?.components[name];
  if (!state || !component) return errorResult(`Component "${name}" is not installed.`);

  const previousStatus = component.enabled ? 'enabled' : 'disabled';
  component.enabled = !component.enabled;
  const nextStatus = component.enabled ? 'enabled' : 'disabled';
  await writeState(cwd, state);

  if (json) return { output: `${JSON.stringify({ name, previousStatus, status: nextStatus, component: { name, ...component } }, null, 2)}\n`, exitCode: 0 };
  return { output: frame('toggle component', `${name}\n\n${status(previousStatus === 'enabled')}  →  ${status(component.enabled)}\n\n${outcome(`Component ${nextStatus}`)}`, `Next: ui component toggle ${name}`), exitCode: 0 };
}
