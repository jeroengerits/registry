import type { CommandResult } from '../../types.js';
import { readState } from '../../state.js';

export async function listComponent(cwd: string, json: boolean): Promise<CommandResult> {
  const state = await readState(cwd);
  if (!state) return { output: json ? '[]\n' : 'No installed components.\n', exitCode: 0 };
  const components = Object.entries(state.components).sort(([a], [b]) => a.localeCompare(b)).map(([name, details]) => ({ name, ...details }));
  return { output: json ? `${JSON.stringify(components, null, 2)}\n` : components.map((component) => `${component.name}@${component.version} (${component.path})`).join('\n') + (components.length ? '\n' : 'No installed components.\n'), exitCode: 0 };
}
