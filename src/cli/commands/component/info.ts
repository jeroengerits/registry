import type { CommandResult } from '../../../types.js';
import { readState } from '../../../state.js';
import { errorResult } from '../shared.js';
import { chooseComponent, frame, outcome, status, table, interactive } from '../../ui.js';

/** Shows one component's persisted metadata and enabled state. */
export async function infoComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  // Load state before deciding whether an interactive picker is possible.
  const state = await readState(cwd);
  // Let interactive users choose a component while keeping scripts explicit.
  if (!name && interactive() && state && Object.keys(state.components).length) name = await chooseComponent(Object.keys(state.components).sort(), 'Select a component to inspect');
  // Non-interactive calls must identify the component in the argument list.
  if (!name) return errorResult('Usage: ui component info <name> [--json]');
  // Resolve the requested record from the validated state map.
  const component = state?.components[name];
  // Report a useful domain error instead of failing during formatting.
  if (!component) return errorResult(`Component "${name}" is not installed.`);
  // JSON consumers receive the complete persisted record without styling.
  if (json) return { output: `${JSON.stringify({ name, ...component }, null, 2)}\n`, exitCode: 0 };
  // Assemble labeled metadata for the human-readable inspection card.
  const lines = [
    `${name}  ${status(component.enabled)}`,
    '',
    table(['Property', 'Value'], [
      ['Version', component.version],
      ['Location', component.path],
      ['Repository', component.repository ?? 'local / unknown'],
      ['Files', String(component.files?.length ?? 0)],
      ['Dependencies', String(component.dependencies?.length ?? 0)],
    ]),
    '',
    outcome('Details loaded.'),
  ];
  // Apply the shared frame and expose the next useful action.
  return { output: frame(`component details  /  ${name}`, lines.join('\n'), 'Next: ui component'), exitCode: 0 };
}
