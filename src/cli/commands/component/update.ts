import type { CommandResult } from '../../../types.js';
import { readState } from '../../../state.js';
import { updateConstraint } from '../../../git.js';
import { addComponent } from './add.js';
import { errorResult } from '../shared.js';

/** Updates one component within its persisted compatible-version constraint. */
export async function updateComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  if (!name) {
    const state = await readState(cwd);
    const names = Object.entries(state?.components ?? {}).filter(([, component]) => component.repository).map(([componentName]) => componentName).sort();
    if (!names.length) return errorResult('No updatable components are installed.');
    const references = names.map((componentName) => {
      const component = state?.components[componentName];
      return `${component?.repository}#${updateConstraint(component?.version ?? '0.0.0', component?.constraint)}`;
    });
    return addComponent(cwd, references, { dryRun: false, force: true, update: true, json, command: 'component update' });
  }
  // Read the stored repository and version constraint for the update request.
  const component = (await readState(cwd))?.components[name];
  // Refuse updates when the component cannot be resolved back to its source.
  if (!component?.repository) return errorResult(`Component "${name}" is not installed or has no repository reference.`);
  // Preserve the existing major-version compatibility policy.
  const constraint = updateConstraint(component.version, component.constraint);
  // Reuse the transactional add pipeline with update-specific presentation.
  return addComponent(cwd, [`${component.repository}#${constraint}`], { dryRun: false, force: true, update: true, json, command: `component update  ·  ${name}` });
}
