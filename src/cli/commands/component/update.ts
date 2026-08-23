import type { CommandResult } from '../../../types.js';
import { readState } from '../../../state.js';
import { availableVersions, updateConstraint } from '../../../git.js';
import { addComponent } from './add.js';
import { errorResult } from '../shared.js';
import { chooseVersion, interactive } from '../../ui.js';

async function selectedVersion(repository: string, current: string): Promise<string> {
  if (!interactive()) return current;
  const versions = await availableVersions(repository);
  if (!versions.length) throw new Error(`Repository ${repository} has no stable semver tag.`);
  return chooseVersion(repository, versions);
}

/** Updates one or all components, optionally pinning this operation to one version. */
export async function updateComponent(cwd: string, name?: string, json = false, version?: string, dryRun = false): Promise<CommandResult> {
  if (version && !/^v?\d+\.\d+\.\d+$/.test(version)) return errorResult('The --version value must be a stable semver version such as 1.2.3.', json);
  if (!name) {
    const state = await readState(cwd);
    const names = Object.entries(state?.components ?? {}).filter(([, component]) => component.repository).map(([componentName]) => componentName).sort();
    if (!names.length) return errorResult('No updatable components are installed.', json);
    const references = names.map((componentName) => {
      const component = state?.components[componentName];
      return `${component?.repository}#${version ?? updateConstraint(component?.version ?? '0.0.0', component?.constraint)}`;
    });
    if (!version && interactive()) {
      const selected = [];
      for (const componentName of names) {
        const component = state?.components[componentName];
        selected.push(`${component?.repository}#${await selectedVersion(component?.repository ?? '', component?.version ?? '0.0.0')}`);
      }
      return addComponent(cwd, selected, { dryRun, force: true, update: true, json, command: 'component update' });
    }
    return addComponent(cwd, references, { dryRun, force: true, update: true, json, command: 'component update' });
  }
  // Read the stored repository and version constraint for the update request.
  const component = (await readState(cwd))?.components[name];
  // Refuse updates when the component cannot be resolved back to its source.
  if (!component?.repository) return errorResult(`Component "${name}" is not installed or has no repository reference.`, json);
  // Preserve the existing major-version compatibility policy.
  const constraint = version ?? await selectedVersion(component.repository, updateConstraint(component.version, component.constraint));
  // Reuse the transactional add pipeline with update-specific presentation.
  return addComponent(cwd, [`${component.repository}#${constraint}`], { dryRun, force: true, update: true, json, command: `component update  ·  ${name}` });
}
