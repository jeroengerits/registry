import type { CommandResult } from '../../../types.js';
import { readState } from '../../../state.js';
import { addComponent } from './add.js';
import { errorResult } from '../shared.js';

/** Updates one component within its persisted compatible-version constraint. */
export async function updateComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  // Updates require a named component because no safe default exists.
  if (!name) return errorResult('Usage: ui component update <name> [--json]');
  // Read the stored repository and version constraint for the update request.
  const component = (await readState(cwd))?.components[name];
  // Refuse updates when the component cannot be resolved back to its source.
  if (!component?.repository) return errorResult(`Component "${name}" is not installed or has no repository reference.`);
  // Preserve the existing major-version compatibility policy.
  const major = component.version.replace(/^v/, '').split('.')[0];
  const constraint = component.constraint ?? `^${major}`;
  // Reuse the transactional add pipeline with update-specific presentation.
  return addComponent(cwd, [`${component.repository}#${constraint}`], { dryRun: false, force: true, update: true, json, command: `component update  ·  ${name}` });
}
