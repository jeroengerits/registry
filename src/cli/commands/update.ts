import type { CommandResult } from '../../types.js';
import { readState } from '../../state.js';
import { addComponent } from './add.js';
import { errorResult } from './shared.js';

export async function updateComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  if (!name) return errorResult('Usage: ui component update <name> [--json]');
  const component = (await readState(cwd))?.components[name];
  if (!component?.repository) return errorResult(`Component "${name}" is not installed or has no repository reference.`);
  const major = component.version.replace(/^v/, '').split('.')[0];
  const constraint = component.constraint ?? `^${major}`;
  return addComponent(cwd, [`${component.repository}#${constraint}`], { dryRun: false, force: true, update: true, json });
}
