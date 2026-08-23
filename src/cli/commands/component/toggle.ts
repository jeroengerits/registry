import type { CommandResult } from '../../../types.js';
import { readState, writeState } from '../../../state.js';
import { resultLine } from '../../ui.js';
import { errorResult } from '../shared.js';
import { present } from '../../presentation.js';

/** Flips one component's enabled state without touching installed files. */
export async function toggleComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  // Read normalized state so missing enabled fields default to true.
  const state = await readState(cwd);
  // One-shot commands require the component name explicitly.
  if (!name) return errorResult('Usage: ui component toggle <name> [--json]', json);
  // Resolve the selected component before mutating state.
  const component = state?.components[name];
  // Never create state implicitly for an unknown component.
  if (!state || !component) return errorResult(`Component "${name}" is not installed.`, json);

  // Capture the old label for the transition shown to the user.
  const previousStatus = component.enabled ? 'enabled' : 'disabled';
  // Toggle only the persisted status; files and versions remain untouched.
  component.enabled = !component.enabled;
  // Derive the new label from the value that will be persisted.
  const nextStatus = component.enabled ? 'enabled' : 'disabled';
  // Atomically persist the one-field state change.
  await writeState(cwd, state);

  // Keep JSON output stable and free from prompts or terminal control codes.
  if (json) return present(true, { name, previousStatus, status: nextStatus, component: { name, ...component } }, '');
  // Show the transition and make the non-destructive behavior explicit.
  return { output: resultLine(nextStatus, name), exitCode: 0 };
}

/** Sets a component's enabled state idempotently for script-friendly commands. */
export async function setComponentEnabled(cwd: string, name: string | undefined, enabled: boolean, json = false): Promise<CommandResult> {
  const state = await readState(cwd);
  if (!name) return errorResult(`Usage: ui ${enabled ? 'enable' : 'disable'} <name> [--json]`, json);
  const component = state?.components[name];
  if (!state || !component) return errorResult(`Component "${name}" is not installed.`, json);
  const previousStatus = component.enabled ? 'enabled' : 'disabled';
  component.enabled = enabled;
  const nextStatus = enabled ? 'enabled' : 'disabled';
  await writeState(cwd, state);
  if (json) return present(true, { name, previousStatus, status: nextStatus, component: { name, ...component } }, '');
  return { output: resultLine(nextStatus, name), exitCode: 0 };
}
