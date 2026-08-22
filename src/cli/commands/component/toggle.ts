import type { CommandResult } from '../../../types.js';
import { readState, writeState } from '../../../state.js';
import { chooseComponent, frame, interactive, outcome, status } from '../../ui.js';
import { errorResult } from '../shared.js';

/** Flips one component's enabled state without touching installed files. */
export async function toggleComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  // Read normalized state so missing enabled fields default to true.
  const state = await readState(cwd);
  // Offer a picker only when a human can interact with the terminal.
  if (!name && interactive() && state && Object.keys(state.components).length) name = await chooseComponent(Object.keys(state.components).sort(), 'Select a component to toggle');
  // Require an explicit name in automation and redirected output.
  if (!name) return errorResult('Usage: ui component toggle <name> [--json]');
  // Resolve the selected component before mutating state.
  const component = state?.components[name];
  // Never create state implicitly for an unknown component.
  if (!state || !component) return errorResult(`Component "${name}" is not installed.`);

  // Capture the old label for the transition shown to the user.
  const previousStatus = component.enabled ? 'enabled' : 'disabled';
  // Toggle only the persisted status; files and versions remain untouched.
  component.enabled = !component.enabled;
  // Derive the new label from the value that will be persisted.
  const nextStatus = component.enabled ? 'enabled' : 'disabled';
  // Atomically persist the one-field state change.
  await writeState(cwd, state);

  // Keep JSON output stable and free from prompts or terminal control codes.
  if (json) return { output: `${JSON.stringify({ name, previousStatus, status: nextStatus, component: { name, ...component } }, null, 2)}\n`, exitCode: 0 };
  // Show the transition and make the non-destructive behavior explicit.
  return { output: frame('component status', `${name}\n\n${status(previousStatus === 'enabled')}  →  ${status(component.enabled)}\n\n${outcome(`${name} is ${nextStatus}.`)}`, 'Next: ui component'), exitCode: 0 };
}
