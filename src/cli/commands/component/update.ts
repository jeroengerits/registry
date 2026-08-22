import type { CommandResult } from '../../../types.js';
import { readState } from '../../../state.js';
import { addComponent } from './add.js';
import { errorResult } from '../shared.js';

/** Updates one component within its persisted compatible-version constraint. */
export async function updateComponent(cwd: string, name?: string, json = false): Promise<CommandResult> {
  if (!name) {
    const state = await readState(cwd);
    const names = Object.entries(state?.components ?? {}).filter(([, component]) => component.repository).map(([componentName]) => componentName).sort();
    if (!names.length) return errorResult('No updatable components are installed.');
    const results = [];
    for (const componentName of names) results.push(await updateComponent(cwd, componentName, json));
    if (json) return { output: `[${results.map((result) => result.output.trim()).join(',')}]\n`, exitCode: results.some((result) => result.exitCode !== 0) ? 1 : 0 };
    return { output: results.map((result) => result.output).join('\n'), exitCode: results.some((result) => result.exitCode !== 0) ? 1 : 0 };
  }
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
