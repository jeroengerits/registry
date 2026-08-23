import type { CommandResult } from '../../../types.js';
import { readState } from '../../../state.js';
import { errorResult } from '../shared.js';
import { present } from '../../presentation.js';
import { frame, status, table } from '../../ui.js';

/** Shows one component's persisted metadata and enabled state. */
export async function infoComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  // Load state before resolving the requested component.
  const state = await readState(cwd);
  // One-shot commands require the component name explicitly.
  if (!name) return errorResult('Usage: ui show <name> [--json]', json);
  // Resolve the requested record from the validated state map.
  const component = state?.components[name];
  // Report a useful domain error instead of failing during formatting.
  if (!component) return errorResult(`Component "${name}" is not installed.`, json);
  // JSON consumers receive the complete persisted record without styling.
  if (json) return present(true, { name, ...component }, '');
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
  ];
  // Apply the shared frame and expose the next useful action.
  return { output: frame(`component details  /  ${name}`, lines.join('\n')), exitCode: 0 };
}
