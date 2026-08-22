import type { CommandResult } from '../types.js';
import { readState } from '../state.js';
import { errorResult } from './shared.js';

export async function infoComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  if (!name) return errorResult('Usage: ui components info <name> [--json]');
  const component = (await readState(cwd))?.components[name];
  if (!component) return errorResult(`Component "${name}" is not installed.`);
  return { output: json ? `${JSON.stringify({ name, ...component }, null, 2)}\n` : `${name}@${component.version}\nPath: ${component.path}\n`, exitCode: 0 };
}
